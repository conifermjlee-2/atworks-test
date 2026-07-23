package com.atworks.backend.validationv3;

import com.atworks.backend.similarity.ApiSimilarityResponse;
import com.atworks.backend.validationv2.ValidationRuleDto;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpEntity;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpMethod;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestTemplate;

import java.net.URL;
import java.util.*;
import java.util.regex.Pattern;

@Slf4j
@Service
@RequiredArgsConstructor
public class ValidationV3Service {

    private final ObjectMapper objectMapper = new ObjectMapper();
    private final RestTemplate restTemplate = new RestTemplate();

    public ValidationV3Response getRecommendations(String swaggerUrl, String targetUrl, String targetMethod) {
        List<MatchedApiDto> matchedApis = new ArrayList<>();
        List<ValidationRuleDto> allExtractedRules = new ArrayList<>();

        try {
            // 1. Swagger 가져오기
            String jsonContent = restTemplate.getForObject(swaggerUrl, String.class);
            if (jsonContent == null) throw new RuntimeException("Swagger 문서 로드 실패");
            JsonNode rootNode = objectMapper.readTree(jsonContent);

            // 타겟 경로 정규화 (호스트명 제외)
            String targetPath = targetUrl;
            try {
                URL url = new URL(targetUrl);
                targetPath = url.getPath();
            } catch (Exception e) {}

            // 2. 타겟 API의 응답 필드 맵 추출 (1-depth)
            Map<String, String> targetFields = getResponseFields(rootNode, targetPath, targetMethod);
            if (targetFields.isEmpty()) {
                log.warn("타겟 API의 응답 필드를 찾을 수 없습니다: {} {}", targetMethod, targetPath);
            }

            // 3. 전체 API 순회하며 타입 매칭 검사
            JsonNode pathsNode = rootNode.path("paths");
            Iterator<Map.Entry<String, JsonNode>> pathsIter = pathsNode.fields();

            String baseUrl = swaggerUrl;
            try {
                java.net.URI uri = new java.net.URI(swaggerUrl);
                baseUrl = uri.getScheme() + "://" + uri.getAuthority();
            } catch (Exception e) {}

            while (pathsIter.hasNext()) {
                Map.Entry<String, JsonNode> pathEntry = pathsIter.next();
                String path = pathEntry.getKey();
                JsonNode methods = pathEntry.getValue();

                Iterator<Map.Entry<String, JsonNode>> methodIter = methods.fields();
                while (methodIter.hasNext()) {
                    Map.Entry<String, JsonNode> methodEntry = methodIter.next();
                    String method = methodEntry.getKey();

                    // 타겟 API 자기 자신은 스킵 (path와 method가 일치하는지 정규식 검사)
                    String pathRegex = "^" + path.replaceAll("\\{[^/]+\\}", "[^/]+") + "$";
                    if (Pattern.compile(pathRegex).matcher(targetPath).matches() && method.equalsIgnoreCase(targetMethod)) {
                        continue;
                    }

                    // 응답 필드 맵 추출
                    Map<String, String> apiFields = getResponseFields(rootNode, path, method);

                    // 교집합(매칭되는 필드) 찾기
                    Set<String> matchingFieldNames = new HashSet<>();
                    for (Map.Entry<String, String> entry : apiFields.entrySet()) {
                        String fieldName = entry.getKey();
                        String fieldType = entry.getValue();
                        if (fieldType.equals(targetFields.get(fieldName))) {
                            matchingFieldNames.add(fieldName);
                        }
                    }

                    // 하나라도 일치하면 후보(Matched API)로 등록
                    if (!matchingFieldNames.isEmpty()) {
                        JsonNode operation = methodEntry.getValue();
                        String summary = operation.path("summary").asText("");
                        String description = operation.path("description").asText("");

                        // 실제 API 호출 시도
                        Map<String, Object> extractedData = executeAndExtractValues(baseUrl, path, method, matchingFieldNames, allExtractedRules);

                        matchedApis.add(MatchedApiDto.builder()
                                .path(path)
                                .method(method.toUpperCase())
                                .summary(summary)
                                .description(description)
                                .extractedData(extractedData)
                                .build());
                    }
                }
            }

        } catch (Exception e) {
            log.error("V3 믹스매치 처리 중 오류 발생", e);
        }

        // 4. 필드(jsonPath) 단위로 믹스매치(Mix & Match) 진행
        Map<String, List<ValidationRuleDto>> rulesByPath = new HashMap<>();
        for (ValidationRuleDto rule : allExtractedRules) {
            rulesByPath.computeIfAbsent(rule.getJsonPath(), k -> new ArrayList<>()).add(rule);
        }

        List<ValidationRuleDto> uniqueRules = new ArrayList<>();
        java.util.Random random = new java.util.Random();
        for (List<ValidationRuleDto> rulesForPath : rulesByPath.values()) {
            int randomIndex = random.nextInt(rulesForPath.size());
            uniqueRules.add(rulesForPath.get(randomIndex));
        }

        // 프론트엔드 출력을 위해, 최종 채택된 룰에 기여한(당첨된) API가 먼저 나오도록 정렬 (내림차순)
        matchedApis.sort((a, b) -> {
            long aCount = uniqueRules.stream().filter(r -> r.getSourceApi().equals(a.getPath())).count();
            long bCount = uniqueRules.stream().filter(r -> r.getSourceApi().equals(b.getPath())).count();
            return Long.compare(bCount, aCount);
        });

        return ValidationV3Response.builder()
                .matchedApis(matchedApis)
                .recommendedRules(uniqueRules)
                .build();
    }

    private Map<String, Object> executeAndExtractValues(String baseUrl, String path, String method, Set<String> matchingFieldNames, List<ValidationRuleDto> rules) {
        if ("delete".equalsIgnoreCase(method)) {
            return Collections.emptyMap(); // DELETE는 부작용 위험으로 제외
        }

        if (path.contains("{")) {
            return Collections.emptyMap(); // Path Variable이 있는 경우 현재는 안전하게 Skip
        }

        String fullUrl = baseUrl + path;
        try {
            String jsonContent = null;
            if ("get".equalsIgnoreCase(method)) {
                jsonContent = restTemplate.getForObject(fullUrl, String.class);
            } else if ("post".equalsIgnoreCase(method) || "put".equalsIgnoreCase(method)) {
                HttpHeaders headers = new HttpHeaders();
                headers.setContentType(MediaType.APPLICATION_JSON);
                HttpEntity<String> entity = new HttpEntity<>("{}", headers); // 빈 JSON으로 시도
                
                HttpMethod httpMethod = "post".equalsIgnoreCase(method) ? HttpMethod.POST : HttpMethod.PUT;
                jsonContent = restTemplate.exchange(fullUrl, httpMethod, entity, String.class).getBody();
            }

            if (jsonContent != null && !jsonContent.isBlank()) {
                JsonNode responseNode = objectMapper.readTree(jsonContent);
                return extractMatchedFields(responseNode, matchingFieldNames, rules, path);
            }
        } catch (Exception e) {
            log.warn("V3 실제 API 호출 실패 (Skip): [{}] {}", method.toUpperCase(), fullUrl);
        }
        return Collections.emptyMap();
    }

    private Map<String, Object> extractMatchedFields(JsonNode responseNode, Set<String> matchingFieldNames, List<ValidationRuleDto> rules, String sourceApi) {
        Map<String, Object> extractedData = new HashMap<>();
        if (responseNode.isObject()) {
            Iterator<Map.Entry<String, JsonNode>> fields = responseNode.fields();
            while (fields.hasNext()) {
                Map.Entry<String, JsonNode> field = fields.next();
                String fieldName = field.getKey();

                if (matchingFieldNames.contains(fieldName)) {
                    JsonNode valNode = field.getValue();
                    if (valNode.isValueNode()) {
                        String type = "string";
                        Object rawValue = valNode.asText();
                        if (valNode.isNumber()) { type = "number"; rawValue = valNode.numberValue(); }
                        else if (valNode.isBoolean()) { type = "boolean"; rawValue = valNode.booleanValue(); }
                        
                        extractedData.put(fieldName, rawValue);

                        String actualValue = valNode.asText();
                        if ("string".equals(type)) {
                            actualValue = "\"" + actualValue + "\"";
                        }

                        rules.add(ValidationRuleDto.builder()
                                .jsonPath("$." + fieldName) // 1-depth만 허용
                                .type(type)
                                .exampleValue(actualValue)
                                .sourceApi(sourceApi)
                                .build());
                    }
                }
            }
        }
        return extractedData;
    }

    private Map<String, String> getResponseFields(JsonNode rootNode, String path, String method) {
        Map<String, String> fields = new HashMap<>();

        // 경로가 다를 수 있으므로 정규식 매칭을 시도
        JsonNode pathsNode = rootNode.path("paths");
        JsonNode operation = null;
        
        Iterator<Map.Entry<String, JsonNode>> pathsIter = pathsNode.fields();
        while (pathsIter.hasNext()) {
            Map.Entry<String, JsonNode> pathEntry = pathsIter.next();
            String p = pathEntry.getKey();
            String regex = "^" + p.replaceAll("\\{[^/]+\\}", "[^/]+") + "$";
            if (Pattern.compile(regex).matcher(path).matches()) {
                operation = pathEntry.getValue().path(method.toLowerCase());
                break;
            }
        }

        if (operation == null || operation.isMissingNode()) return fields;

        JsonNode content = operation.path("responses").path("200").path("content");
        JsonNode schema = null;
        if (content.has("application/json")) {
            schema = content.path("application/json").path("schema");
        } else if (content.has("*/*")) {
            schema = content.path("*/*").path("schema");
        }

        if (schema != null && !schema.isMissingNode()) {
            schema = resolveSchema(rootNode, schema);
            if (schema != null && schema.has("properties")) {
                JsonNode properties = schema.path("properties");
                Iterator<Map.Entry<String, JsonNode>> propsIter = properties.fields();
                while (propsIter.hasNext()) {
                    Map.Entry<String, JsonNode> prop = propsIter.next();
                    String propName = prop.getKey();
                    JsonNode propSchema = resolveSchema(rootNode, prop.getValue());
                    if (propSchema != null) {
                        String type = propSchema.path("type").asText("object");
                        fields.put(propName, type);
                    }
                }
            }
        }

        return fields;
    }

    private JsonNode resolveSchema(JsonNode rootNode, JsonNode schema) {
        if (schema.has("$ref")) {
            String ref = schema.get("$ref").asText();
            String schemaName = ref.substring(ref.lastIndexOf('/') + 1);
            JsonNode components = rootNode.path("components").path("schemas");
            JsonNode resolved = components.path(schemaName);
            if (!resolved.isMissingNode()) {
                return resolveSchema(rootNode, resolved);
            }
        }
        return schema;
    }
}
