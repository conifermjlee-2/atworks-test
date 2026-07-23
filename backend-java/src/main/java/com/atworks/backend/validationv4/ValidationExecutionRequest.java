package com.atworks.backend.validationv4;

import lombok.Data;
import java.util.List;
import java.util.Map;

@Data
public class ValidationExecutionRequest {
    private String url;
    private String method;
    private Map<String, String> headers;
    private List<ValidationExecutionRuleDto> rules;
}
