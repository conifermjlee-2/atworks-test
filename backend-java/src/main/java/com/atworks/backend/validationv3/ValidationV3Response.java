package com.atworks.backend.validationv3;

import com.atworks.backend.similarity.ApiSimilarityResponse;
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
public class ValidationV3Response {
    private List<MatchedApiDto> matchedApis; // V3 uses deterministic matching with extracted data
    private List<ValidationRuleDto> recommendedRules;
}
