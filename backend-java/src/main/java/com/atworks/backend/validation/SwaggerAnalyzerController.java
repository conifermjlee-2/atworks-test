package com.atworks.backend.validation;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/analyzer")
@RequiredArgsConstructor
@Tag(name = "Swagger Analyzer API", description = "Swagger 스펙 분석 및 규칙 추천")
public class SwaggerAnalyzerController {

    private final SwaggerAnalyzerService analyzerService;

    @PostMapping("/recommend")
    @Operation(summary = "값 검증 규칙 추천", description = "Swagger 스펙의 제약조건을 기반으로 추천 규칙 목록을 반환합니다.")
    public ResponseEntity<List<Map<String, Object>>> recommendRules(@RequestBody SwaggerAnalyzerRequest request) {
        List<Map<String, Object>> recommendedRules = analyzerService.recommendRules(
                request.getSwaggerUrl(),
                request.getTargetPath(),
                request.getTargetMethod()
        );
        return ResponseEntity.ok(recommendedRules);
    }
}
