package com.atworks.backend.sample;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.media.Schema;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.Data;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.Arrays;
import java.util.List;

@RestController
@RequestMapping("/api/delivery/v4")
@Tag(name = "Delivery V4 (N-Depth) API", description = "V4 믹스매치 테스트용 다중 계층(N-Depth) 예시 API")
public class DeliveryV4Controller {

    @GetMapping("/standard-order")
    @Operation(summary = "일반 배송 주문 (V4)", description = "1-Depth(deliveryId, weight, status)와 N-Depth 구조를 모두 가지는 일반 배송 (제약조건 없음)")
    public StandardOrderDto getStandardOrder() {
        StandardOrderDto dto = new StandardOrderDto();
        dto.setDeliveryId("DEL-001");
        dto.setWeight(5.5);
        dto.setStatus("PREPARING");
        
        StandardOrderDto.OrderInfo info = new StandardOrderDto.OrderInfo();
        info.setOrderId("STD-001");
        info.setPrice(3000);
        info.setDeliveryStatus("PREPARING");
        dto.setOrderInfo(info);

        StandardOrderDto.Customer customer = new StandardOrderDto.Customer();
        customer.setName("홍길동");
        StandardOrderDto.Contact contact = new StandardOrderDto.Contact();
        contact.setPhone("010-1111-1111");
        contact.setEmail("hong@test.com");
        customer.setContact(contact);
        dto.setCustomer(customer);

        StandardOrderDto.Item item1 = new StandardOrderDto.Item();
        item1.setItemId("ITEM-A");
        item1.setQuantity(1);
        dto.setItems(Arrays.asList(item1));

        return dto;
    }

    @GetMapping("/express-order")
    @Operation(summary = "특급 배송 주문 (V4)", description = "1-Depth와 N-Depth 구조를 모두 가지는 특급 배송 (enum 및 숫자 제약조건 포함)")
    public ExpressOrderDto getExpressOrder() {
        ExpressOrderDto dto = new ExpressOrderDto();
        dto.setDeliveryId("EXP-001");
        dto.setWeight(2.0);
        dto.setStatus("IN_TRANSIT");
        
        ExpressOrderDto.OrderInfo info = new ExpressOrderDto.OrderInfo();
        info.setOrderId("EXP-001");
        info.setPrice(15000);
        info.setDeliveryStatus("IN_TRANSIT");
        dto.setOrderInfo(info);

        ExpressOrderDto.Customer customer = new ExpressOrderDto.Customer();
        customer.setName("김철수");
        ExpressOrderDto.Contact contact = new ExpressOrderDto.Contact();
        contact.setPhone("010-2222-2222");
        contact.setEmail("kim@test.com");
        customer.setContact(contact);
        dto.setCustomer(customer);

        ExpressOrderDto.Item item1 = new ExpressOrderDto.Item();
        item1.setItemId("ITEM-B");
        item1.setQuantity(5);
        dto.setItems(Arrays.asList(item1));

        return dto;
    }

    @GetMapping("/international-order")
    @Operation(summary = "해외 배송 주문 (V4)", description = "1-Depth와 N-Depth 구조를 모두 가지는 해외 배송 (다른 enum 제약조건 포함)")
    public InternationalOrderDto getInternationalOrder() {
        InternationalOrderDto dto = new InternationalOrderDto();
        dto.setDeliveryId("INT-001");
        dto.setWeight(15.0);
        dto.setStatus("CUSTOMS_CLEARED");
        
        InternationalOrderDto.OrderInfo info = new InternationalOrderDto.OrderInfo();
        info.setOrderId("INT-001");
        info.setPrice(50000);
        info.setDeliveryStatus("CUSTOMS_CLEARED");
        dto.setOrderInfo(info);

        InternationalOrderDto.Customer customer = new InternationalOrderDto.Customer();
        customer.setName("John Doe");
        InternationalOrderDto.Contact contact = new InternationalOrderDto.Contact();
        contact.setPhone("010-3333-3333");
        contact.setEmail("john@test.com");
        customer.setContact(contact);
        dto.setCustomer(customer);

        InternationalOrderDto.Item item1 = new InternationalOrderDto.Item();
        item1.setItemId("ITEM-C");
        item1.setQuantity(10);
        dto.setItems(Arrays.asList(item1));

        return dto;
    }

    @GetMapping("/tracking-event")
    @Operation(summary = "단일 배송 이벤트 조회 (V4 이질성 테스트용)", description = "앞선 3개의 주문 API와 전혀 다른 필드 구조(교집합 없음)를 가지는 다중 계층 API")
    public TrackingEventDto getTrackingEvent() {
        TrackingEventDto dto = new TrackingEventDto();
        dto.setEventId("EVT-999");
        
        TrackingEventDto.Details details = new TrackingEventDto.Details();
        
        TrackingEventDto.Location loc = new TrackingEventDto.Location();
        loc.setLatitude(37.5665);
        loc.setLongitude(126.9780);
        loc.setAddress("Seoul City Hall");
        details.setLocation(loc);
        
        TrackingEventDto.HistoryLog log1 = new TrackingEventDto.HistoryLog();
        log1.setTimestamp("2026-07-06T10:00:00");
        log1.setDescription("배송 출발");
        
        details.setHistoryLogs(Arrays.asList(log1));
        dto.setDetails(details);
        
        return dto;
    }

    // ==========================================
    // DTOs
    // ==========================================

    @Data
    public static class StandardOrderDto {
        @Schema(description = "배송 ID")
        private String deliveryId;
        @Schema(description = "무게")
        private Double weight;
        @Schema(description = "1Depth 배송 상태 (제약조건 없음)")
        private String status;

        private OrderInfo orderInfo;
        private Customer customer;
        private List<Item> items;

        @Data
        public static class OrderInfo {
            private String orderId;
            private Integer price;
            @Schema(description = "배송 상태 (제약조건 없음)")
            private String deliveryStatus;
        }
        @Data
        public static class Customer {
            private String name;
            private Contact contact;
        }
        @Data
        public static class Contact {
            private String phone;
            private String email;
        }
        @Data
        public static class Item {
            private String itemId;
            private Integer quantity;
        }
    }

    @Data
    public static class ExpressOrderDto {
        @Schema(description = "배송 ID")
        private String deliveryId;
        @Schema(description = "무게 (1.0 이상)", minimum = "1.0")
        private Double weight;
        @Schema(description = "1Depth 배송 상태", allowableValues = {"PREPARING", "IN_TRANSIT"})
        private String status;

        private OrderInfo orderInfo;
        private Customer customer;
        private List<Item> items;

        @Data
        public static class OrderInfo {
            private String orderId;
            @Schema(description = "가격 (10000 이상)", minimum = "10000")
            private Integer price;
            @Schema(description = "배송 상태", allowableValues = {"PREPARING", "IN_TRANSIT"})
            private String deliveryStatus;
        }
        @Data
        public static class Customer {
            private String name;
            private Contact contact;
        }
        @Data
        public static class Contact {
            private String phone;
            private String email;
        }
        @Data
        public static class Item {
            private String itemId;
            @Schema(description = "수량 (1 이상)", minimum = "1")
            private Integer quantity;
        }
    }

    @Data
    public static class InternationalOrderDto {
        @Schema(description = "배송 ID")
        private String deliveryId;
        @Schema(description = "무게 (5.0 이상)", minimum = "5.0")
        private Double weight;
        @Schema(description = "1Depth 배송 상태", allowableValues = {"CUSTOMS_CLEARED", "SHIPPED", "DELIVERED"})
        private String status;

        private OrderInfo orderInfo;
        private Customer customer;
        private List<Item> items;

        @Data
        public static class OrderInfo {
            private String orderId;
            @Schema(description = "가격 (30000 이상)", minimum = "30000")
            private Integer price;
            @Schema(description = "배송 상태", allowableValues = {"CUSTOMS_CLEARED", "SHIPPED", "DELIVERED"})
            private String deliveryStatus;
        }
        @Data
        public static class Customer {
            private String name;
            private Contact contact;
        }
        @Data
        public static class Contact {
            private String phone;
            private String email;
        }
        @Data
        public static class Item {
            private String itemId;
            private Integer quantity;
        }
    }

    @Data
    public static class TrackingEventDto {
        private String eventId;
        private Details details;
        
        @Data
        public static class Details {
            private Location location;
            private List<HistoryLog> historyLogs;
        }
        
        @Data
        public static class Location {
            private Double latitude;
            private Double longitude;
            private String address;
        }
        
        @Data
        public static class HistoryLog {
            private String timestamp;
            private String description;
        }
    }
}
