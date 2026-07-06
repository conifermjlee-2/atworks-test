package com.atworks.backend.validationv3;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.Map;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class MatchedApiDto {
    private String path;
    private String method;
    private String summary;
    private String description;
    
    // 이 API를 실제 실행하여 뽑아낸 원본 데이터의 덩어리 (개인 바구니)
    private Map<String, Object> extractedData;
}
