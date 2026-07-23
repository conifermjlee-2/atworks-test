package com.atworks.backend.registry;

import lombok.*;
import java.time.LocalDateTime;

@Getter @Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class ApiRegistryResponse {
    private Long id;
    private String name;
    private String description;
    private String apiGroup;
    private String url;
    private String httpMethod;
    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;

    public static ApiRegistryResponse from(ApiRegistry entity) {
        return ApiRegistryResponse.builder()
                .id(entity.getId())
                .name(entity.getName())
                .description(entity.getDescription())
                .apiGroup(entity.getApiGroup())
                .url(entity.getUrl())
                .httpMethod(entity.getHttpMethod())
                .createdAt(entity.getCreatedAt())
                .updatedAt(entity.getUpdatedAt())
                .build();
    }
}
