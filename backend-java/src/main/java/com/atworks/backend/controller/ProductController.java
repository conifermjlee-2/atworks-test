package com.atworks.backend.controller;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.media.Schema;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.Builder;
import lombok.Data;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.Arrays;
import java.util.List;

@RestController
@RequestMapping("/api/products")
@Tag(name = "Product API", description = "상품 카탈로그 조회 API")
public class ProductController {

    @GetMapping
    @Operation(summary = "상품 목록 조회", description = "조건에 맞는 상품 목록을 페이징하여 조회합니다.")
    public ResponseEntity<List<ProductDto>> getProducts(
            @Parameter(description = "조회할 페이지 번호", example = "1") @RequestParam(defaultValue = "1") int page,
            @Parameter(description = "한 페이지당 항목 수", example = "20") @RequestParam(defaultValue = "20") int size) {
        
        List<ProductDto> products = Arrays.asList(
            ProductDto.builder().id(1L).name("MacBook Pro").price(2500000.0).stockQuantity(10).category("ELECTRONICS").build(),
            ProductDto.builder().id(2L).name("AirPods").price(350000.0).stockQuantity(50).category("ELECTRONICS").build()
        );
        
        return ResponseEntity.ok(products);
    }

    @Data
    @Builder
    public static class ProductDto {
        @Schema(description = "상품 ID", example = "1")
        private Long id;
        
        @Schema(description = "상품명", example = "MacBook Pro", minLength = 2, maxLength = 100)
        private String name;
        
        @Schema(description = "상품 가격 (0 이상)", example = "2500000.0", minimum = "0.0")
        private Double price;
        
        @Schema(description = "재고 수량 (0 이상)", example = "10", minimum = "0")
        private Integer stockQuantity;
        
        @Schema(description = "카테고리명", example = "ELECTRONICS")
        private String category;
    }
}
