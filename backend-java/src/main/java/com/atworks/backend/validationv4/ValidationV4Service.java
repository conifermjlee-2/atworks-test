package com.atworks.backend.validationv4;

import com.atworks.backend.validationv2.ValidationRuleDto;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import com.jayway.jsonpath.JsonPath;
import com.jayway.jsonpath.PathNotFoundException;
import org.springframework.http.HttpEntity;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpMethod;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestTemplate;

import java.net.URL;
import java.util.*;
import java.util.regex.Pattern;

@Slf4j
@Service
@RequiredArgsConstructor
public class ValidationV4Service {

    private final ObjectMapper objectMapper = new ObjectMapper();
    private final RestTemplate restTemplate = new RestTemplate();

    public ValidationV4Response getRecommendations(String swaggerUrl, String targetUrl, String targetMethod) {
        List<MatchedApiDto> matchedApis = new ArrayList<>();
        List<ValidationRuleDto> allExtractedRules = new ArrayList<>();

        try {
            // 1. Swagger 가져오기
            String jsonContent = restTemplate.getForObject(swaggerUrl, String.class);
            if (jsonContent == null) throw new RuntimeException("Swagger 문서 로드 실패");
            JsonNode rootNode = objectMapper.readTree(jsonContent);

            String targetPath = targetUrl;
            try {
                URL url = new URL(targetUrl);
                targetPath = url.getPath();
            } catch (Exception e) {}

            // 2. 타겟 API의 응답 필드 맵 추출 (N-depth)
            Map<String, String> targetFields = getResponseFields(rootNode, targetPath, targetMethod);
            if (targetFields.isEmpty()) {
                log.warn("타겟 API의 응답 필드를 찾을 수 없습니다: {} {}", targetMethod, targetPath);
            }

            JsonNode pathsNode = rootNode.path("paths");
            Iterator<Map.Entry<String, JsonNode>> pathsIter = pathsNode.fields();

            String baseUrl = swaggerUrl;
            try {
                java.net.URI uri = new java.net.URI(swaggerUrl);
                baseUrl = uri.getScheme() + "://" + uri.getAuthority();
            } catch (Exception e) {}

            int maxApiCalls = 20;
            int apiCallCount = 0;

            while (pathsIter.hasNext() && apiCallCount < maxApiCalls) {
                Map.Entry<String, JsonNode> pathEntry = pathsIter.next();
                String path = pathEntry.getKey();
                JsonNode methods = pathEntry.getValue();

                Iterator<Map.Entry<String, JsonNode>> methodIter = methods.fields();
                while (methodIter.hasNext() && apiCallCount < maxApiCalls) {
                    Map.Entry<String, JsonNode> methodEntry = methodIter.next();
                    String method = methodEntry.getKey();

                    String pathRegex = "^" + path.replaceAll("\\{[^/]+\\}", "[^/]+") + "$";
                    if (Pattern.compile(pathRegex).matcher(targetPath).matches() && method.equalsIgnoreCase(targetMethod)) {
                        continue;
                    }

                    // 응답 필드 맵 추출 (N-Depth)
                    Map<String, String> apiFields = getResponseFields(rootNode, path, method);

                    // 교집합(매칭되는 jsonPath) 찾기
                    Set<String> matchingFieldPaths = new HashSet<>();
                    for (Map.Entry<String, String> entry : apiFields.entrySet()) {
                        String jsonPath = entry.getKey();
                        String fieldType = entry.getValue();
                        if (fieldType.equals(targetFields.get(jsonPath))) {
                            matchingFieldPaths.add(jsonPath);
                        }
                    }

                    if (!matchingFieldPaths.isEmpty()) {
                        JsonNode operation = methodEntry.getValue();
                        String summary = operation.path("summary").asText("");
                        String description = operation.path("description").asText("");

                        Map<String, Object> extractedData = executeAndExtractValues(baseUrl, path, method, matchingFieldPaths, allExtractedRules);
                        
                        if (!extractedData.isEmpty()) {
                            matchedApis.add(MatchedApiDto.builder()
                                    .path(path)
                                    .method(method.toUpperCase())
                                    .summary(summary)
                                    .description(description)
                                    .extractedData(extractedData)
                                    .build());
                            apiCallCount++;
                        }
                    }
                }
            }

        } catch (Exception e) {
            log.error("V4 믹스매치 처리 중 오류 발생", e);
        }

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

        matchedApis.sort((a, b) -> {
            long aCount = uniqueRules.stream().filter(r -> r.getSourceApi().equals(a.getPath())).count();
            long bCount = uniqueRules.stream().filter(r -> r.getSourceApi().equals(b.getPath())).count();
            return Long.compare(bCount, aCount);
        });

        return ValidationV4Response.builder()
                .matchedApis(matchedApis)
                .recommendedRules(uniqueRules)
                .build();
    }

    private Map<String, Object> executeAndExtractValues(String baseUrl, String path, String method, Set<String> matchingFieldPaths, List<ValidationRuleDto> rules) {
        if ("delete".equalsIgnoreCase(method) || path.contains("{")) {
            return Collections.emptyMap();
        }

        String fullUrl = baseUrl + path;
        try {
            String jsonContent = null;
            if ("get".equalsIgnoreCase(method)) {
                jsonContent = restTemplate.getForObject(fullUrl, String.class);
            } else if ("post".equalsIgnoreCase(method) || "put".equalsIgnoreCase(method)) {
                HttpHeaders headers = new HttpHeaders();
                headers.setContentType(MediaType.APPLICATION_JSON);
                HttpEntity<String> entity = new HttpEntity<>("{}", headers);
                
                HttpMethod httpMethod = "post".equalsIgnoreCase(method) ? HttpMethod.POST : HttpMethod.PUT;
                jsonContent = restTemplate.exchange(fullUrl, httpMethod, entity, String.class).getBody();
            }

            if (jsonContent != null && !jsonContent.isBlank()) {
                JsonNode responseNode = objectMapper.readTree(jsonContent);
                Map<String, Object> extractedData = new HashMap<>();
                extractRulesFromActualResponse("$", responseNode, matchingFieldPaths, rules, path, extractedData);
                return extractedData;
            }
        } catch (Exception e) {
            log.warn("V4 실제 API 호출 실패 (Skip): [{}] {}", method.toUpperCase(), fullUrl);
        }
        return Collections.emptyMap();
    }

    private void extractRulesFromActualResponse(String currentPath, JsonNode node, Set<String> matchingFieldPaths, List<ValidationRuleDto> rules, String sourceApi, Map<String, Object> extractedData) {
        if (node.isObject()) {
            Iterator<Map.Entry<String, JsonNode>> fields = node.fields();
            while (fields.hasNext()) {
                Map.Entry<String, JsonNode> field = fields.next();
                String fieldName = field.getKey();
                String nextPath = currentPath.equals("$") ? "$." + fieldName : currentPath + "." + fieldName;
                extractRulesFromActualResponse(nextPath, field.getValue(), matchingFieldPaths, rules, sourceApi, extractedData);
            }
        } else if (node.isArray()) {
            if (node.size() > 0) {
                String nextPath = currentPath + "[0]";
                extractRulesFromActualResponse(nextPath, node.get(0), matchingFieldPaths, rules, sourceApi, extractedData);
            }
        } else if (node.isValueNode()) {
            if (matchingFieldPaths.contains(currentPath)) {
                String type = "string";
                Object rawValue = node.asText();
                if (node.isNumber()) { type = "number"; rawValue = node.numberValue(); }
                else if (node.isBoolean()) { type = "boolean"; rawValue = node.booleanValue(); }

                extractedData.put(currentPath, rawValue);

                String actualValue = node.asText();
                if ("string".equals(type)) {
                    actualValue = "\"" + actualValue + "\"";
                }

                rules.add(ValidationRuleDto.builder()
                        .jsonPath(currentPath)
                        .type(type)
                        .exampleValue(actualValue)
                        .sourceApi(sourceApi)
                        .build());
            }
        }
    }

    private Map<String, String> getResponseFields(JsonNode rootNode, String path, String method) {
        Map<String, String> fields = new HashMap<>();

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
            flattenFields("", schema, rootNode, fields, new HashSet<>(), 0);
        }

        return fields;
    }

    private void flattenFields(String prefix, JsonNode schema, JsonNode rootNode, Map<String, String> fields, Set<String> visited, int depth) {
        if (depth > 5) return; // 최대 탐색 깊이 제한

        schema = resolveSchema(rootNode, schema, visited);
        if (schema == null) return;

        String type = schema.path("type").asText("object");

        if ("object".equals(type) && schema.has("properties")) {
            JsonNode properties = schema.path("properties");
            Iterator<Map.Entry<String, JsonNode>> propsIter = properties.fields();
            while (propsIter.hasNext()) {
                Map.Entry<String, JsonNode> prop = propsIter.next();
                String path = prefix.isEmpty() ? prop.getKey() : prefix + "." + prop.getKey();
                flattenFields(path, prop.getValue(), rootNode, fields, new HashSet<>(visited), depth + 1);
            }
        } else if ("array".equals(type) && schema.has("items")) {
            flattenFields(prefix + "[0]", schema.path("items"), rootNode, fields, new HashSet<>(visited), depth + 1);
        } else {
            if (!prefix.isEmpty()) {
                fields.put("$." + prefix, type);
            }
        }
    }

    private JsonNode resolveSchema(JsonNode rootNode, JsonNode schema, Set<String> visited) {
        if (schema.has("$ref")) {
            String ref = schema.get("$ref").asText();
            if (visited.contains(ref)) return null; // 순환 참조 차단
            visited.add(ref);
            
            String schemaName = ref.substring(ref.lastIndexOf('/') + 1);
            JsonNode components = rootNode.path("components").path("schemas");
            JsonNode resolved = components.path(schemaName);
            if (!resolved.isMissingNode()) {
                return resolveSchema(rootNode, resolved, visited);
            }
        }
        return schema;
    }

    // ================== [채점 엔진 실행부] ==================

    public ValidationExecutionResponse executeValidation(ValidationExecutionRequest request) {
        String url = request.getUrl();
        HttpMethod method = HttpMethod.valueOf(request.getMethod() != null ? request.getMethod().toUpperCase() : "GET");
        HttpHeaders headers = new HttpHeaders();
        if (request.getHeaders() != null) {
            request.getHeaders().forEach(headers::add);
        }

        HttpEntity<String> entity = new HttpEntity<>("", headers);
        
        Integer statusCode = 500;
        String responseBody = "";
        
        try {
            ResponseEntity<String> response = restTemplate.exchange(url, method, entity, String.class);
            statusCode = response.getStatusCode().value();
            responseBody = response.getBody() != null ? response.getBody() : "";
        } catch (Exception e) {
            log.error("API Fetch Error", e);
            responseBody = e.getMessage();
        }

        ValidationExecutionResponse.ExecutionResult execResult = ValidationExecutionResponse.ExecutionResult.builder()
                .statusCode(statusCode)
                .responseBody(responseBody)
                .build();

        if (request.getRules() == null || request.getRules().isEmpty()) {
            return ValidationExecutionResponse.builder()
                    .executionResult(execResult)
                    .validationResults(new ArrayList<>())
                    .globalPassed(true)
                    .build();
        }

        List<ValidationResultDto> validationResults = new ArrayList<>();
        JsonNode parsedJson = null;
        try {
            parsedJson = objectMapper.readTree(responseBody);
        } catch (Exception e) {
            // Not JSON
        }

        for (ValidationExecutionRuleDto rule : request.getRules()) {
            String actualValue = "N/A (Invalid JSON)";
            boolean passed = false;

            if (parsedJson != null) {
                try {
                    String path = rule.getFieldPath();
                    if (path != null && !path.startsWith("$")) {
                        path = "$" + (path.startsWith("[") ? "" : ".") + path;
                    }

                    Object resultObj = JsonPath.read(responseBody, path);
                    if (resultObj != null) {
                        if (resultObj instanceof java.util.List) {
                            java.util.List<?> arr = (java.util.List<?>) resultObj;
                            if (!arr.isEmpty()) {
                                actualValue = String.valueOf(arr.get(0));
                            } else {
                                actualValue = "N/A (Path not found)";
                            }
                        } else {
                            actualValue = String.valueOf(resultObj);
                        }
                        
                        if (!"N/A (Path not found)".equals(actualValue)) {
                            passed = evaluateCondition(actualValue, rule.getOperator(), rule.getExpectedValue(), rule.getValueType());
                        }
                    } else {
                        actualValue = "N/A (Path not found)";
                        passed = false;
                    }
                } catch (PathNotFoundException e) {
                    actualValue = "N/A (Path not found)";
                    passed = false;
                } catch (Exception e) {
                    actualValue = "Error: " + e.getMessage();
                    passed = false;
                }
            }

            validationResults.add(ValidationResultDto.builder()
                    .rule(rule)
                    .actualValue(actualValue)
                    .passed(passed)
                    .build());
        }

        // Calculate global passed
        boolean globalPassed = true;
        boolean currentGroupPassed = true;

        for (int i = 0; i < request.getRules().size(); i++) {
            ValidationExecutionRuleDto rule = request.getRules().get(i);
            boolean passed = validationResults.get(i).getPassed();

            if ("NONE".equals(rule.getLogicalOperator()) || rule.getLogicalOperator() == null) {
                if (!currentGroupPassed) globalPassed = false;
                currentGroupPassed = passed;
            } else if ("AND".equals(rule.getLogicalOperator())) {
                currentGroupPassed = currentGroupPassed && passed;
            } else if ("OR".equals(rule.getLogicalOperator())) {
                currentGroupPassed = currentGroupPassed || passed;
            }
        }
        if (!currentGroupPassed) globalPassed = false;

        // Sorting
        if (parsedJson != null) {
            List<String> pathOrder = new ArrayList<>();
            traverseJson(parsedJson, "", pathOrder);

            validationResults.sort((a, b) -> {
                String pathA = a.getRule().getFieldPath().replaceAll("^\\$\\.?", "");
                String pathB = b.getRule().getFieldPath().replaceAll("^\\$\\.?", "");
                int idxA = pathOrder.indexOf(pathA);
                int idxB = pathOrder.indexOf(pathB);
                
                if (idxA == -1 && idxB == -1) return 0;
                if (idxA == -1) return 1;
                if (idxB == -1) return -1;
                if (idxA == idxB) return 0;
                return Integer.compare(idxA, idxB);
            });
        }

        return ValidationExecutionResponse.builder()
                .executionResult(execResult)
                .validationResults(validationResults)
                .globalPassed(globalPassed)
                .build();
    }

    private void traverseJson(JsonNode node, String currentPath, List<String> pathOrder) {
        if (node == null || node.isNull()) return;
        
        if (node.isArray()) {
            for (int i = 0; i < node.size(); i++) {
                String childPath = currentPath + "[" + i + "]";
                pathOrder.add(childPath);
                traverseJson(node.get(i), childPath, pathOrder);
            }
        } else if (node.isObject()) {
            Iterator<Map.Entry<String, JsonNode>> fields = node.fields();
            while (fields.hasNext()) {
                Map.Entry<String, JsonNode> field = fields.next();
                String key = field.getKey();
                String childPath = currentPath.isEmpty() ? key : currentPath + "." + key;
                pathOrder.add(childPath);
                traverseJson(field.getValue(), childPath, pathOrder);
            }
        }
    }

    private boolean evaluateCondition(String actualStr, String operator, String expectedStr, String valueType) {
        try {
            if ("NUMBER".equalsIgnoreCase(valueType)) {
                double actual = Double.parseDouble(actualStr);
                double expected = Double.parseDouble(expectedStr);
                switch (operator) {
                    case "=": return actual == expected;
                    case "!=": return actual != expected;
                    case ">": return actual > expected;
                    case "<": return actual < expected;
                    case ">=": return actual >= expected;
                    case "<=": return actual <= expected;
                    default: return false;
                }
            } else if ("BOOLEAN".equalsIgnoreCase(valueType)) {
                boolean actual = Boolean.parseBoolean(actualStr);
                boolean expected = Boolean.parseBoolean(expectedStr);
                switch (operator) {
                    case "=": return actual == expected;
                    case "!=": return actual != expected;
                    default: return false;
                }
            } else {
                switch (operator) {
                    case "=": return actualStr.equals(expectedStr);
                    case "!=": return !actualStr.equals(expectedStr);
                    case ">": return actualStr.compareTo(expectedStr) > 0;
                    case "<": return actualStr.compareTo(expectedStr) < 0;
                    case ">=": return actualStr.compareTo(expectedStr) >= 0;
                    case "<=": return actualStr.compareTo(expectedStr) <= 0;
                    case "contains": return actualStr.contains(expectedStr);
                    default: return false;
                }
            }
        } catch (Exception e) {
            return false;
        }
    }
}
