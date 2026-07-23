package com.atworks.backend.validationv2;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import com.atworks.backend.similarity.ApiSimilarityResponse;

import java.util.List;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class ValidationV2Response {
    private List<ApiSimilarityResponse> similarApis;
    private List<ValidationRuleDto> recommendedRules;
}
