package com.atworks.backend.registry;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/registry")
@RequiredArgsConstructor
@Tag(name = "API Registry", description = "API 등록 및 관리")
public class ApiRegistryController {

    private final ApiRegistryService service;
    private final SwaggerPullService swaggerPullService;

    @GetMapping
    @Operation(summary = "등록된 API 전체 목록 조회")
    public ResponseEntity<List<ApiRegistryResponse>> findAll() {
        return ResponseEntity.ok(service.findAll());
    }

    @GetMapping("/{id}")
    @Operation(summary = "API 단건 조회")
    public ResponseEntity<ApiRegistryResponse> findById(@PathVariable Long id) {
        return ResponseEntity.ok(service.findById(id));
    }

    @PostMapping("/pull")
    @Operation(summary = "Swagger 스펙 연동 (Pull)", description = "주어진 Swagger JSON URL에서 API 목록을 긁어와 자동 등록합니다.")
    public ResponseEntity<Map<String, Object>> pullSwagger(@RequestBody com.atworks.backend.registry.SwaggerPullRequest request) {
        int addedCount = swaggerPullService.pullAndRegister(request.getSwaggerUrl());
        return ResponseEntity.ok(Map.of(
            "message", "Swagger pull successful",
            "addedCount", addedCount
        ));
    }

    @PostMapping
    @Operation(summary = "API 신규 등록")
    public ResponseEntity<ApiRegistryResponse> create(@RequestBody ApiRegistryRequest request) {
        return ResponseEntity.status(HttpStatus.CREATED).body(service.create(request));
    }

    @PutMapping("/{id}")
    @Operation(summary = "API 정보 수정")
    public ResponseEntity<ApiRegistryResponse> update(
            @PathVariable Long id,
            @RequestBody ApiRegistryRequest request) {
        return ResponseEntity.ok(service.update(id, request));
    }

    @DeleteMapping("/{id}")
    @Operation(summary = "API 삭제")
    public ResponseEntity<Void> delete(@PathVariable Long id) {
        service.delete(id);
        return ResponseEntity.noContent().build();
    }

    @DeleteMapping("/batch")
    @Operation(summary = "API 일괄 삭제")
    public ResponseEntity<Void> deleteBatch(@RequestBody List<Long> ids) {
        service.deleteByIds(ids);
        return ResponseEntity.noContent().build();
    }
}
