package com.atworks.backend.registry;

import lombok.*;

@Getter @Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class ApiRegistryRequest {
    private String name;
    private String description;
    private String apiGroup;
    private String url;
    private String httpMethod;
}
