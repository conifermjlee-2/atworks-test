package com.atworks.backend.sample;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.Data;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import io.swagger.v3.oas.annotations.media.Schema;

@RestController
@RequestMapping("/api/delivery")
@Tag(name = "Delivery API", description = "배송 관련 교차 추천 테스트 API")
public class DeliveryController {

    @GetMapping("/standard")
    @Operation(summary = "일반 배송 조회", description = "제약조건이 없는 일반 배송 정보 (여기서 추천을 받으면 다른 API의 제약조건을 가져옵니다)")
    public StandardDeliveryDto getStandardDelivery() {
        StandardDeliveryDto dto = new StandardDeliveryDto();
        dto.setDeliveryId("DEL-001");
        dto.setWeight(5.5);
        dto.setStatus("PREPARING");
        return dto;
    }

    @GetMapping("/express")
    @Operation(summary = "특급 배송 조회", description = "특급 배송 정보 (enum 제약조건 포함)")
    public ExpressDeliveryDto getExpressDelivery() {
        ExpressDeliveryDto dto = new ExpressDeliveryDto();
        dto.setDeliveryId("EXP-001");
        dto.setWeight(2.0);
        dto.setStatus("IN_TRANSIT");
        return dto;
    }

    @GetMapping("/international")
    @Operation(summary = "해외 배송 조회", description = "해외 배송 정보 (다른 enum 제약조건 및 minimum 포함)")
    public InternationalDeliveryDto getInternationalDelivery() {
        InternationalDeliveryDto dto = new InternationalDeliveryDto();
        dto.setDeliveryId("INT-001");
        dto.setWeight(15.0);
        dto.setStatus("CUSTOMS_CLEARED");
        return dto;
    }

    @Data
    public static class StandardDeliveryDto {
        @Schema(description = "배송 ID")
        private String deliveryId;
        
        @Schema(description = "무게")
        private Double weight;
        
        @Schema(description = "배송 상태 (제약조건 없음)")
        private String status;
    }

    @Data
    public static class ExpressDeliveryDto {
        @Schema(description = "배송 ID")
        private String deliveryId;
        
        @Schema(description = "무게 (1.0 이상)", minimum = "1.0")
        private Double weight;
        
        @Schema(description = "배송 상태", allowableValues = {"PREPARING", "IN_TRANSIT"})
        private String status;
    }

    @Data
    public static class InternationalDeliveryDto {
        @Schema(description = "배송 ID")
        private String deliveryId;
        
        @Schema(description = "무게 (5.0 이상)", minimum = "5.0")
        private Double weight;
        
        @Schema(description = "배송 상태", allowableValues = {"CUSTOMS_CLEARED", "SHIPPED", "DELIVERED"})
        private String status;
    }
}
