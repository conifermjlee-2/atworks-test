package com.atworks.backend.validationv2;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

@Slf4j
@RestController
@RequestMapping("/api/validation-v2")
@RequiredArgsConstructor
public class ValidationV2Controller {

    private final ValidationV2Service validationV2Service;

    @GetMapping("/recommend")
    public ResponseEntity<ValidationV2Response> getRecommendations(
            @RequestParam String swaggerUrl,
            @RequestParam String targetUrl,
            @RequestParam(defaultValue = "GET") String targetMethod) {
        
        log.info("값 검증 V2 (AI 룰 추천) 요청: swaggerUrl={}, targetUrl={}, method={}", swaggerUrl, targetUrl, targetMethod);
        ValidationV2Response result = validationV2Service.getRecommendations(swaggerUrl, targetUrl, targetMethod);
        return ResponseEntity.ok(result);
    }
}
