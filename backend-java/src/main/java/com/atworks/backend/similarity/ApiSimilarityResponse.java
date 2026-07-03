package com.atworks.backend.similarity;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class ApiSimilarityResponse {
    private String path;
    private String method;
    private String summary;
    private String description;
    private double similarityScore; // 0.0 ~ 1.0 (Cosine Similarity)
}
