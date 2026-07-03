package com.atworks.backend.similarity;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import dev.langchain4j.data.embedding.Embedding;
import dev.langchain4j.data.segment.TextSegment;
import dev.langchain4j.model.embedding.EmbeddingModel;
import dev.langchain4j.model.embedding.AllMiniLmL6V2QuantizedEmbeddingModel;
import dev.langchain4j.store.embedding.CosineSimilarity;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestTemplate;

import java.net.URL;
import java.util.*;
import java.util.regex.Pattern;

@Slf4j
@Service
public class ApiSimilarityService {

    private final ObjectMapper objectMapper = new ObjectMapper();
    private final RestTemplate restTemplate = new RestTemplate();
    
    // In-Memory 캐싱: Swagger URL 당 한 번 파싱 및 임베딩을 수행하면 여기에 저장
    private final Map<String, List<ApiEmbeddingData>> embeddingCache = new HashMap<>();

    // 80MB 초경량 로컬 AI 모델 (ONNX) - 서버 기동 시 1번 메모리에 로드됨
    private final EmbeddingModel embeddingModel = new AllMiniLmL6V2QuantizedEmbeddingModel();

    // 임베딩 및 원본 메타데이터 보관 객체
    private static class ApiEmbeddingData {
        String path;
        String method;
        String summary;
        String description;
        Embedding embedding;

        public ApiEmbeddingData(String path, String method, String summary, String description, Embedding embedding) {
            this.path = path;
            this.method = method;
            this.summary = summary;
            this.description = description;
            this.embedding = embedding;
        }
    }

    public List<ApiSimilarityResponse> findSimilarApis(String swaggerUrl, String targetUrl, String targetMethod) {
        try {
            // 1. Swagger 스펙 로드 및 모든 API 임베딩 생성 (In-Memory 캐싱)
            List<ApiEmbeddingData> allApis = embeddingCache.computeIfAbsent(swaggerUrl, this::loadAndEmbedSwagger);

            // 2. 타겟 API의 Path 추출 및 검색
            String pathOnly = targetUrl;
            try {
                URL url = new URL(targetUrl);
                pathOnly = url.getPath();
            } catch (Exception e) {}

            ApiEmbeddingData targetApi = null;
            for (ApiEmbeddingData api : allApis) {
                String regex = "^" + api.path.replaceAll("\\{[^/]+\\}", "[^/]+") + "$";
                if (Pattern.compile(regex).matcher(pathOnly).matches() && api.method.equalsIgnoreCase(targetMethod)) {
                    targetApi = api;
                    break;
                }
            }

            if (targetApi == null) {
                throw new RuntimeException("Target API를 Swagger에서 찾을 수 없습니다.");
            }

            // 3. 코사인 유사도(Cosine Similarity) 계산 및 Top 5 정렬
            List<ApiSimilarityResponse> results = new ArrayList<>();
            for (ApiEmbeddingData api : allApis) {
                // 자기 자신은 제외
                if (api == targetApi) continue;

                // 의미를 담을 텍스트가 없어서 임베딩이 실패한 경우는 스킵
                if (api.embedding == null || targetApi.embedding == null) continue;

                double similarity = CosineSimilarity.between(targetApi.embedding, api.embedding);
                
                results.add(ApiSimilarityResponse.builder()
                        .path(api.path)
                        .method(api.method.toUpperCase())
                        .summary(api.summary)
                        .description(api.description)
                        .similarityScore(Math.round(similarity * 1000.0) / 10.0) // 0~100 % 변환 (소수점 첫째자리)
                        .build());
            }

            // 점수 내림차순 정렬
            results.sort((a, b) -> Double.compare(b.getSimilarityScore(), a.getSimilarityScore()));

            // 전체 리턴
            return results;

        } catch (Exception e) {
            log.error("API 유사도 분석 실패", e);
            throw new RuntimeException("API 유사도 분석 실패: " + e.getMessage());
        }
    }

    private List<ApiEmbeddingData> loadAndEmbedSwagger(String swaggerUrl) {
        log.info("Swagger 분석 및 AI 임베딩 생성 시작... (약 2~5초 소요 예상)");
        List<ApiEmbeddingData> apis = new ArrayList<>();
        try {
            String jsonContent = restTemplate.getForObject(swaggerUrl, String.class);
            if (jsonContent == null) throw new RuntimeException("Empty response");
            JsonNode rootNode = objectMapper.readTree(jsonContent);

            JsonNode pathsNode = rootNode.path("paths");
            if (pathsNode.isMissingNode()) return apis;

            Iterator<Map.Entry<String, JsonNode>> pathsIter = pathsNode.fields();
            while (pathsIter.hasNext()) {
                Map.Entry<String, JsonNode> pathEntry = pathsIter.next();
                String path = pathEntry.getKey();
                JsonNode methods = pathEntry.getValue();

                Iterator<Map.Entry<String, JsonNode>> methodIter = methods.fields();
                while (methodIter.hasNext()) {
                    Map.Entry<String, JsonNode> methodEntry = methodIter.next();
                    String method = methodEntry.getKey();
                    JsonNode operation = methodEntry.getValue();
                    
                    String summary = operation.path("summary").asText("");
                    String description = operation.path("description").asText("");
                    
                    // 분석을 위한 핵심 텍스트 구성
                    // Path 자체에 의미가 담긴 경우가 많으므로 병합
                    String textToEmbed = String.format("Path: %s, Summary: %s, Description: %s", path, summary, description);

                    // 텍스트가 너무 짧으면 의미 비교가 무의미하므로 기본 텍스트 삽입
                    if (summary.isEmpty() && description.isEmpty()) {
                        textToEmbed = "API Endpoint for " + path;
                    }

                    // ONNX AI 모델로 텍스트를 벡터(숫자 배열)로 변환
                    Embedding embedding = embeddingModel.embed(TextSegment.from(textToEmbed)).content();
                    
                    apis.add(new ApiEmbeddingData(path, method, summary, description, embedding));
                }
            }
            log.info("총 {} 개의 API에 대한 AI 임베딩 캐싱 완료!", apis.size());
            return apis;
        } catch (Exception e) {
            log.error("Swagger 로드 또는 임베딩 실패", e);
            throw new RuntimeException("임베딩 실패", e);
        }
    }
}
