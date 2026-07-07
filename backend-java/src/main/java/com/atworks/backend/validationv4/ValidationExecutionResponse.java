package com.atworks.backend.validationv4;

import lombok.Builder;
import lombok.Data;
import java.util.List;

@Data
@Builder
public class ValidationExecutionResponse {
    private ExecutionResult executionResult;
    private List<ValidationResultDto> validationResults;
    private Boolean globalPassed;

    @Data
    @Builder
    public static class ExecutionResult {
        private Integer statusCode;
        private String responseBody;
    }
}
