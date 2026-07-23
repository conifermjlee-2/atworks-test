package com.atworks.backend.validationv2;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class ValidationRuleDto {
    private String jsonPath;
    private String type; // e.g. "string", "number", "boolean"
    private String exampleValue;
    private String sourceApi; // 어느 API에서 이 룰을 가져왔는지
}
