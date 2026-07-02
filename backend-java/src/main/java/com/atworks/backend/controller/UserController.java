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
@RequestMapping("/api/users")
@Tag(name = "User API", description = "유저 프로필 조회 API")
public class UserController {

    @GetMapping("/{id}")
    @Operation(summary = "유저 프로필 조회", description = "ID를 통해 특정 유저의 상세 정보를 조회합니다.")
    public ResponseEntity<UserProfileDto> getUserProfile(
            @Parameter(description = "유저 고유 ID", example = "1") @PathVariable("id") Long id) {
        
        UserProfileDto mockUser = UserProfileDto.builder()
                .id(id)
                .username("DeGreen")
                .email("degreen@atworks.com")
                .age(29)
                .isActive(true)
                .build();
                
        return ResponseEntity.ok(mockUser);
    }

    @Data
    @Builder
    public static class UserProfileDto {
        @Schema(description = "유저 ID", example = "1")
        private Long id;
        
        @Schema(description = "유저 이름", example = "DeGreen")
        private String username;
        
        @Schema(description = "이메일 주소 (유효한 형식이어야 함)", example = "test@test.com")
        private String email;
        
        @Schema(description = "나이 (0 이상의 정수)", example = "29", minimum = "0")
        private Integer age;
        
        @Schema(description = "계정 활성화 상태", example = "true")
        private Boolean isActive;
    }
}
