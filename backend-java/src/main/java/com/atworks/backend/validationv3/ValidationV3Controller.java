package com.atworks.backend.validationv3;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

@Slf4j
@RestController
@RequestMapping("/api/validation-v3")
@RequiredArgsConstructor
public class ValidationV3Controller {

    private final ValidationV3Service validationV3Service;

    @GetMapping("/recommend")
    public ResponseEntity<ValidationV3Response> getRecommendations(
            @RequestParam String swaggerUrl,
            @RequestParam String targetUrl,
            @RequestParam(defaultValue = "GET") String targetMethod) {
        
        log.info("값 검증 V3 (Type 매칭) 요청: swaggerUrl={}, targetUrl={}, method={}", swaggerUrl, targetUrl, targetMethod);
        ValidationV3Response result = validationV3Service.getRecommendations(swaggerUrl, targetUrl, targetMethod);
        return ResponseEntity.ok(result);
    }
}
