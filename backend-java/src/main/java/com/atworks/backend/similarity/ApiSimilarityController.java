package com.atworks.backend.similarity;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@Slf4j
@RestController
@RequestMapping("/api/similarity")
@RequiredArgsConstructor
public class ApiSimilarityController {

    private final ApiSimilarityService apiSimilarityService;

    @GetMapping("/recommend")
    public ResponseEntity<List<ApiSimilarityResponse>> recommendSimilarApis(
            @RequestParam String swaggerUrl,
            @RequestParam String targetUrl,
            @RequestParam(defaultValue = "GET") String targetMethod) {
        
        log.info("유사 API 검색 요청: swaggerUrl={}, targetUrl={}, method={}", swaggerUrl, targetUrl, targetMethod);
        List<ApiSimilarityResponse> result = apiSimilarityService.findSimilarApis(swaggerUrl, targetUrl, targetMethod);
        return ResponseEntity.ok(result);
    }
}
