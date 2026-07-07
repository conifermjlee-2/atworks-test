package com.atworks.backend.validationv4;

import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import io.swagger.v3.oas.annotations.Operation;

@RestController
@RequestMapping("/api/tester")
@RequiredArgsConstructor
public class ValidationV4Controller {

    private final ValidationV4Service validationV4Service;

    @GetMapping("/recommend-v4")
    public ResponseEntity<ValidationV4Response> getV4Recommendations(
            @RequestParam String swaggerUrl,
            @RequestParam String targetUrl,
            @RequestParam String targetMethod) {

        ValidationV4Response response = validationV4Service.getRecommendations(swaggerUrl, targetUrl, targetMethod);
        return ResponseEntity.ok(response);
    }

    @PostMapping("/execute")
    @Operation(summary = "값 검증 채점 엔진 실행", description = "입력한 API URL을 직접 호출하여 얻은 응답 데이터를 바탕으로 전달된 룰(Rules)들을 채점합니다.")
    public ResponseEntity<ValidationExecutionResponse> executeValidation(@RequestBody ValidationExecutionRequest request) {
        return ResponseEntity.ok(validationV4Service.executeValidation(request));
    }
}
