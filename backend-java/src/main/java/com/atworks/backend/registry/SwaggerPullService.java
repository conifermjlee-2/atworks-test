package com.atworks.backend.registry;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.client.RestTemplate;

import java.util.Iterator;
import java.util.Map;

@Slf4j
@Service
@RequiredArgsConstructor
public class SwaggerPullService {

    private final ApiRegistryRepository repository;
    private final ObjectMapper objectMapper = new ObjectMapper();
    private final RestTemplate restTemplate = new RestTemplate();

    @Transactional
    public int pullAndRegister(String swaggerUrl) {
        log.info("Pulling Swagger JSON from URL: {}", swaggerUrl);
        int addedCount = 0;

        try {
            // 1. Fetch Swagger JSON
            String jsonContent = restTemplate.getForObject(swaggerUrl, String.class);
            if (jsonContent == null) {
                throw new RuntimeException("Empty response from Swagger URL");
            }

            JsonNode rootNode = objectMapper.readTree(jsonContent);
            JsonNode pathsNode = rootNode.path("paths");

            if (pathsNode.isMissingNode() || !pathsNode.isObject()) {
                throw new RuntimeException("Invalid Swagger JSON: 'paths' field is missing.");
            }

            // 2. Base URL 추출 로직 (선택적)
            String baseUrl = "";
            JsonNode serversNode = rootNode.path("servers");
            if (serversNode.isArray() && serversNode.size() > 0) {
                baseUrl = serversNode.get(0).path("url").asText();
                if (baseUrl.equals("/")) baseUrl = ""; // Ignore simple relative base
            }

            // 3. Iterate over paths and methods
            Iterator<Map.Entry<String, JsonNode>> pathsIterator = pathsNode.fields();
            while (pathsIterator.hasNext()) {
                Map.Entry<String, JsonNode> pathEntry = pathsIterator.next();
                String pathUrl = pathEntry.getKey();
                JsonNode methodsNode = pathEntry.getValue();

                Iterator<Map.Entry<String, JsonNode>> methodsIterator = methodsNode.fields();
                while (methodsIterator.hasNext()) {
                    Map.Entry<String, JsonNode> methodEntry = methodsIterator.next();
                    String httpMethod = methodEntry.getKey().toUpperCase();
                    JsonNode operationNode = methodEntry.getValue();

                    String summary = operationNode.path("summary").asText("No Summary");
                    String description = operationNode.path("description").asText("");
                    
                    String group = "Default";
                    JsonNode tagsNode = operationNode.path("tags");
                    if (tagsNode.isArray() && tagsNode.size() > 0) {
                        group = tagsNode.get(0).asText();
                    }

                    String fullUrl = baseUrl + pathUrl;

                    // 4. 중복 체크 (URL과 HTTP Method가 동일하면 스킵하거나 업데이트)
                    // 현재는 간단히 중복이면 넘어가는 구조로 작성
                    boolean exists = repository.findAll().stream()
                            .anyMatch(api -> api.getUrl().equals(fullUrl) && api.getHttpMethod().equals(httpMethod));

                    if (!exists) {
                        ApiRegistry registry = ApiRegistry.builder()
                                .name(summary)
                                .description(description)
                                .apiGroup(group)
                                .url(fullUrl)
                                .httpMethod(httpMethod)
                                .build();
                        repository.save(registry);
                        addedCount++;
                    }
                }
            }
            log.info("Successfully registered {} new APIs from Swagger.", addedCount);
            return addedCount;

        } catch (Exception e) {
            log.error("Failed to pull Swagger from URL: {}", swaggerUrl, e);
            throw new RuntimeException("Swagger Pull 실패: " + e.getMessage(), e);
        }
    }
}
