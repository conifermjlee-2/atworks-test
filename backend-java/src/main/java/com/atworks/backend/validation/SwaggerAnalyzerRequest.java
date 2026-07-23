package com.atworks.backend.validation;

import lombok.Data;

@Data
public class SwaggerAnalyzerRequest {
    private String swaggerUrl;
    private String targetPath;
    private String targetMethod;
}
