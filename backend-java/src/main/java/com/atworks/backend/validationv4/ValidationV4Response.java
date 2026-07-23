package com.atworks.backend.validationv4;

import com.atworks.backend.validationv2.ValidationRuleDto;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class ValidationV4Response {
    private List<MatchedApiDto> matchedApis;
    private List<ValidationRuleDto> recommendedRules;
}
