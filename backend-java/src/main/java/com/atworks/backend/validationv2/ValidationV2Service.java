package com.atworks.backend.validationv2;

import com.atworks.backend.similarity.ApiSimilarityResponse;
import com.atworks.backend.similarity.ApiSimilarityService;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestTemplate;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.Iterator;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.HashSet;

@Slf4j
@Service
@RequiredArgsConstructor
public class ValidationV2Service {

    private final ApiSimilarityService apiSimilarityService;
    private final ObjectMapper objectMapper = new ObjectMapper();
    private final RestTemplate restTemplate = new RestTemplate();

    public ValidationV2Response getRecommendations(String swaggerUrl, String targetUrl, String targetMethod) {
        // 1. 기존 AI 로직을 호출하여 유사 API 목록을 가져옴
        List<ApiSimilarityResponse> similarApis = apiSimilarityService.findSimilarApis(swaggerUrl, targetUrl,
                targetMethod);

        // 모든 유사 API의 룰을 추출할 리스트
        List<ValidationRuleDto> allExtractedRules = new ArrayList<>();

        // 유사도 75% 이상인 "진짜 비슷한" API들끼리만 믹스매치 진행 (상관없는 API의 필드가 섞이는 것을 방지)
        List<ApiSimilarityResponse> apisToMix = similarApis.stream()
                .filter(api -> api.getSimilarityScore() >= 75.0)
                .toList();

        // 만약 75% 이상이 없으면 가장 비슷한 1등만 사용
        if (apisToMix.isEmpty() && !similarApis.isEmpty()) {
            apisToMix = List.of(similarApis.get(0));
        }

        // Target API를 먼저 호출하여 유효한 필드(Path) 목록을 추출합니다.
        Set<String> validTargetPaths = new HashSet<>();
        try {
            String targetResponse = restTemplate.getForObject(targetUrl, String.class);
            if (targetResponse != null && !targetResponse.isBlank()) {
                JsonNode targetNode = objectMapper.readTree(targetResponse);
                List<ValidationRuleDto> tempRules = new ArrayList<>();
                extractRulesFromActualResponse("$", targetNode, tempRules, "TARGET");
                for (ValidationRuleDto r : tempRules) {
                    validTargetPaths.add(r.getJsonPath());
                }
            }
        } catch (Exception e) {
            log.warn("Target API 호출 실패 (필드 필터링 불가능): {}", targetUrl);
        }

        if (!apisToMix.isEmpty()) {
            // Extract base url from swaggerUrl
            String baseUrl = swaggerUrl;
            try {
                java.net.URI uri = new java.net.URI(swaggerUrl);
                baseUrl = uri.getScheme() + "://" + uri.getAuthority();
            } catch (Exception e) {
                log.warn("Failed to parse base URL from swagger URL", e);
            }

            for (ApiSimilarityResponse api : apisToMix) {
                // GET 요청만 시도 (파라미터가 필요한 경우 등은 실패 시 스킵)
                if (!"get".equalsIgnoreCase(api.getMethod())) {
                    continue;
                }

                String fullUrl = baseUrl + api.getPath();
                try {
                    String jsonContent = restTemplate.getForObject(fullUrl, String.class);
                    if (jsonContent != null && !jsonContent.isBlank()) {
                        JsonNode responseNode = objectMapper.readTree(jsonContent);
                        extractRulesFromActualResponse("$", responseNode, allExtractedRules, api.getPath());
                    }
                } catch (Exception e) {
                    log.warn("실제 API 호출 실패 (Skip): {}", fullUrl);
                }
            }
        }

        // 필드(jsonPath) 단위로 믹스매치(Mix & Match) 진행하되, Target API에 없는 필드는 제외
        Map<String, List<ValidationRuleDto>> rulesByPath = new HashMap<>();
        for (ValidationRuleDto rule : allExtractedRules) {
            // validTargetPaths가 비어있지 않은데(타겟 응답을 정상적으로 받았는데)
            // 해당 필드가 타겟에 없으면 스킵!
            if (!validTargetPaths.isEmpty() && !validTargetPaths.contains(rule.getJsonPath())) {
                continue;
            }
            rulesByPath.computeIfAbsent(rule.getJsonPath(), k -> new ArrayList<>()).add(rule);
        }

        List<ValidationRuleDto> uniqueRules = new ArrayList<>();
        java.util.Random random = new java.util.Random();
        for (List<ValidationRuleDto> rulesForPath : rulesByPath.values()) {
            // 해당 필드를 가진 API들 중 랜덤하게 하나를 선택하여 최종 룰로 채택
            int randomIndex = random.nextInt(rulesForPath.size());
            uniqueRules.add(rulesForPath.get(randomIndex));
        }

        return ValidationV2Response.builder()
                .similarApis(similarApis)
                .recommendedRules(uniqueRules)
                .build();
    }

    private void extractRulesFromActualResponse(String currentPath, JsonNode node, List<ValidationRuleDto> rules,
            String sourceApi) {
        if (node.isObject()) {
            Iterator<Map.Entry<String, JsonNode>> fields = node.fields();
            while (fields.hasNext()) {
                Map.Entry<String, JsonNode> field = fields.next();
                String fieldName = field.getKey();
                String nextPath = currentPath.equals("$") ? "$." + fieldName : currentPath + "." + fieldName;
                extractRulesFromActualResponse(nextPath, field.getValue(), rules, sourceApi);
            }
        } else if (node.isArray()) {
            if (node.size() > 0) {
                String nextPath = currentPath + "[0]";
                extractRulesFromActualResponse(nextPath, node.get(0), rules, sourceApi);
            }
        } else if (node.isValueNode()) {
            String type = "string";
            if (node.isNumber()) {
                type = "number";
            } else if (node.isBoolean()) {
                type = "boolean";
            }

            // 실제 리턴된 응답값이므로 바로 사용
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
