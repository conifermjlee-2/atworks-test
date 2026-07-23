package com.atworks.backend.validationv4;

import lombok.Data;

@Data
public class ValidationExecutionRuleDto {
    private String fieldPath;
    private String operator;
    private String expectedValue;
    private String valueType;
    private String logicalOperator;
    private Boolean selected;
}
