package com.atworks.backend.validation;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestTemplate;

import java.net.URL;
import java.util.*;
import java.util.regex.Pattern;

@Slf4j
@Service
public class SwaggerAnalyzerService {

    private final ObjectMapper objectMapper = new ObjectMapper();
    private final RestTemplate restTemplate = new RestTemplate();
    
    // In-memory cache for swagger json (simple approach)
    private final Map<String, JsonNode> swaggerCache = new HashMap<>();

    public List<Map<String, Object>> recommendRules(String swaggerUrl, String targetUrl, String targetMethod) {
        List<Map<String, Object>> rules = new ArrayList<>();
        Set<String> targetProperties = new HashSet<>();
        boolean isArray = false;
        try {
            JsonNode rootNode = swaggerCache.get(swaggerUrl);
            if (rootNode == null) {
                String jsonContent = restTemplate.getForObject(swaggerUrl, String.class);
                if (jsonContent == null) throw new RuntimeException("Empty response from Swagger URL");
                rootNode = objectMapper.readTree(jsonContent);
                swaggerCache.put(swaggerUrl, rootNode);
            }

            // Extract path from targetUrl
            String pathOnly = targetUrl;
            try {
                URL url = new URL(targetUrl);
                pathOnly = url.getPath();
            } catch (Exception e) {
            }

            JsonNode pathsNode = rootNode.path("paths");
            JsonNode targetOperationNode = null;

            // Find matching path in Swagger
            Iterator<Map.Entry<String, JsonNode>> pathsIterator = pathsNode.fields();
            while (pathsIterator.hasNext()) {
                Map.Entry<String, JsonNode> pathEntry = pathsIterator.next();
                String swaggerPath = pathEntry.getKey();
                
                String regex = "^" + swaggerPath.replaceAll("\\{[^/]+\\}", "[^/]+") + "$";
                if (Pattern.compile(regex).matcher(pathOnly).matches()) {
                    targetOperationNode = pathEntry.getValue().path(targetMethod.toLowerCase());
                    break;
                }
            }

            if (targetOperationNode != null && !targetOperationNode.isMissingNode()) {
                JsonNode responses = targetOperationNode.path("responses");
                JsonNode successResponse = responses.path("200");
                if (successResponse.isMissingNode()) {
                    successResponse = responses.path("201");
                }

                JsonNode schemaNode = successResponse.path("content").path("*/*").path("schema");
                if (schemaNode.isMissingNode()) {
                    schemaNode = successResponse.path("content").path("application/json").path("schema");
                }

                if (!schemaNode.isMissingNode()) {
                    String ref = null;
                    if (schemaNode.has("$ref")) {
                        ref = schemaNode.get("$ref").asText();
                    } else if (schemaNode.has("items") && schemaNode.path("items").has("$ref")) {
                        ref = schemaNode.path("items").get("$ref").asText();
                        isArray = true;
                    }

                    if (ref != null && ref.startsWith("#/components/schemas/")) {
                        String schemaName = ref.replace("#/components/schemas/", "");
                        JsonNode componentsSchema = rootNode.path("components").path("schemas").path(schemaName);
                        if (!componentsSchema.isMissingNode() && componentsSchema.has("properties")) {
                            Iterator<Map.Entry<String, JsonNode>> propsIter = componentsSchema.path("properties").fields();
                            while (propsIter.hasNext()) {
                                targetProperties.add(propsIter.next().getKey());
                            }
                        }
                    }
                }
            }

            // 교차 추천: 타겟 스키마의 각 속성별로 Swagger 전체를 스캔하여 Value Pool 생성 후 랜덤 픽
            JsonNode schemas = rootNode.path("components").path("schemas");
            for (String propName : targetProperties) {
                List<JsonNode> allDefs = new ArrayList<>();
                if (!schemas.isMissingNode()) {
                    Iterator<Map.Entry<String, JsonNode>> schemasIter = schemas.fields();
                    while (schemasIter.hasNext()) {
                        JsonNode schemaDef = schemasIter.next().getValue();
                        if (schemaDef.has("properties") && schemaDef.path("properties").has(propName)) {
                            allDefs.add(schemaDef.path("properties").get(propName));
                        }
                    }
                }
                
                String propPath = isArray ? "[0]." + propName : propName;
                Map<String, Object> rule = generateSmartRandomRule(propPath, propName, allDefs);
                if (rule != null) {
                    rules.add(rule);
                }
            }

            return rules;
        } catch (Exception e) {
            log.error("Failed to analyze swagger rules", e);
            throw new RuntimeException("Swagger 분석 실패: " + e.getMessage());
        }
    }

    private Map<String, Object> generateSmartRandomRule(String propPath, String propName, List<JsonNode> allDefs) {
        if (allDefs.isEmpty()) return null;
        
        String type = "string";
        List<String> pool = new ArrayList<>();
        Double minNum = null;
        Double maxNum = null;

        for (JsonNode def : allDefs) {
            if (def.has("type")) {
                type = def.get("type").asText();
            }
            if (def.has("example")) pool.add(def.get("example").asText());
            if (def.has("default")) pool.add(def.get("default").asText());
            if (def.has("enum") && def.get("enum").isArray()) {
                for (JsonNode eNode : def.get("enum")) {
                    pool.add(eNode.asText());
                }
            }
            if (type.equals("number") || type.equals("integer")) {
                if (def.has("minimum")) {
                    double val = def.get("minimum").asDouble();
                    minNum = (minNum == null) ? val : Math.max(minNum, val);
                }
                if (def.has("maximum")) {
                    double val = def.get("maximum").asDouble();
                    maxNum = (maxNum == null) ? val : Math.min(maxNum, val);
                }
            }
        }

        String randomValue = "";
        java.util.Random rnd = new java.util.Random();

        // 후보 값(풀)이 있으면 그 중에서 하나 랜덤 픽!
        if (!pool.isEmpty()) {
            randomValue = pool.get(rnd.nextInt(pool.size()));
        } else {
            // 풀이 비어있으면 제약조건에 맞춰서 스마트하게 가짜 값 생성
            if (type.equals("boolean")) {
                randomValue = rnd.nextBoolean() ? "true" : "false";
            } else if (type.equals("number") || type.equals("integer")) {
                double min = (minNum != null) ? minNum : 1.0;
                double max = (maxNum != null) ? maxNum : (min + 100.0);
                if (max <= min) max = min + 10.0;
                double val = min + (rnd.nextDouble() * (max - min));
                randomValue = type.equals("integer") ? String.valueOf(Math.round(val)) : String.valueOf(Math.round(val * 10.0) / 10.0);
            } else {
                randomValue = propName + "_" + (100 + rnd.nextInt(900));
            }
        }

        // 값 검증이 아니라 "값 세팅"이 목적이므로 무조건 "=" 연산자 반환
        return createRule(propPath, "=", randomValue, type, "NONE");
    }

    private Map<String, Object> createRule(String fieldPath, String operator, String expectedValue, String valueType, String logicalOperator) {
        Map<String, Object> rule = new HashMap<>();
        rule.put("fieldPath", fieldPath);
        rule.put("operator", operator);
        rule.put("expectedValue", expectedValue);
        rule.put("valueType", valueType);
        rule.put("logicalOperator", logicalOperator);
        rule.put("selected", true);
        rule.put("isRecommended", true); // Flag to show badge in UI
        return rule;
    }
}
