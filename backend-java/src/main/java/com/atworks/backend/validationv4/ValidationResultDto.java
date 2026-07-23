package com.atworks.backend.validationv4;

import lombok.Builder;
import lombok.Data;

@Data
@Builder
public class ValidationResultDto {
    private ValidationExecutionRuleDto rule;
    private String actualValue;
    private Boolean passed;
}
