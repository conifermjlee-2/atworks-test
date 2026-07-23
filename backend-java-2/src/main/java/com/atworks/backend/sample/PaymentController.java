package com.atworks.backend.sample;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.Builder;
import lombok.Data;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/payments")
@Tag(name = "Payment API", description = "결제 서버 관련 샘플 API")
public class PaymentController {

    @GetMapping("/{id}")
    @Operation(summary = "결제 내역 단건 조회", description = "특정 결제 ID의 결제 상세 정보를 조회합니다.")
    public ResponseEntity<PaymentDto> getPayment(@PathVariable String id) {
        PaymentDto payment = PaymentDto.builder()
                .paymentId(id)
                .amount(150000.0)
                .currency("KRW")
                .status("APPROVED")
                .cardMasked("4321-****-****-1111")
                .approvedAt("2026-07-06T15:30:00Z")
                .build();
        return ResponseEntity.ok(payment);
    }

    @PostMapping
    @Operation(summary = "결제 승인 요청", description = "새로운 결제 승인을 요청합니다.")
    public ResponseEntity<PaymentDto> approvePayment() {
        PaymentDto payment = PaymentDto.builder()
                .paymentId("PAY-999")
                .amount(5000.0)
                .currency("KRW")
                .status("APPROVED")
                .cardMasked("1234-****-****-5678")
                .approvedAt("2026-07-06T16:45:00Z")
                .build();
        return ResponseEntity.ok(payment);
    }

    @Data
    @Builder
    public static class PaymentDto {
        private String paymentId;
        private Double amount;
        private String currency;
        private String status;
        private String cardMasked;
        private String approvedAt;
    }
}
