package com.atworks.backend.sample;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.Builder;
import lombok.Data;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/users")
@Tag(name = "User API", description = "유저 프로필 서버 관련 샘플 API")
public class UserProfileController {

    @GetMapping("/{userId}/profile")
    @Operation(summary = "유저 프로필 조회", description = "특정 유저의 프로필 정보를 조회합니다.")
    public ResponseEntity<UserProfileDto> getUserProfile(@PathVariable String userId) {
        UserProfileDto profile = UserProfileDto.builder()
                .userId(userId)
                .nickname("SuperGamer99")
                .profileImageUrl("https://cdn.example.com/profiles/supergamer99.png")
                .lastLoginIp("192.168.1.10")
                .isPremium(true)
                .devices(List.of("iPhone 14 Pro", "iPad Air 5"))
                .build();
        return ResponseEntity.ok(profile);
    }

    @Data
    @Builder
    public static class UserProfileDto {
        private String userId;
        private String nickname;
        private String profileImageUrl;
        private String lastLoginIp;
        private Boolean isPremium;
        private List<String> devices;
    }
}
