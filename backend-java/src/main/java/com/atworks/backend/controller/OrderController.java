package com.atworks.backend.controller;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.media.Schema;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.Builder;
import lombok.Data;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/orders")
@Tag(name = "Order API", description = "주문 및 배송 조회 API")
public class OrderController {

    @GetMapping("/{orderId}/status")
    @Operation(summary = "주문 배송 상태 조회", description = "특정 주문 번호의 현재 상태를 반환합니다.")
    public ResponseEntity<OrderStatusDto> getOrderStatus(
            @Parameter(description = "주문 번호 (예: ORD-1024)", example = "ORD-1024") @PathVariable("orderId") String orderId) {
        
        OrderStatusDto mockStatus = OrderStatusDto.builder()
                .orderId(orderId)
                .status("SHIPPED")
                .estimatedDelivery("2026-07-05")
                .build();
                
        return ResponseEntity.ok(mockStatus);
    }

    @Data
    @Builder
    public static class OrderStatusDto {
        @Schema(description = "주문 번호", example = "ORD-1024")
        private String orderId;
        
        @Schema(description = "주문 상태", allowableValues = {"PENDING", "SHIPPED", "DELIVERED", "CANCELED"}, example = "SHIPPED")
        private String status;
        
        @Schema(description = "예상 배송일 (YYYY-MM-DD)", example = "2026-07-05")
        private String estimatedDelivery;
    }
}
