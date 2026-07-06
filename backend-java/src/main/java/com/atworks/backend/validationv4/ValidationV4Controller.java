package com.atworks.backend.validationv4;

import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

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
}
