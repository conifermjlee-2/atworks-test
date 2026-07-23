package com.atworks.backend.registry;

import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class ApiRegistryService {

    private final ApiRegistryRepository repository;

    @Transactional(readOnly = true)
    public List<ApiRegistryResponse> findAll() {
        return repository.findAllByOrderByCreatedAtDesc()
                .stream()
                .map(ApiRegistryResponse::from)
                .collect(Collectors.toList());
    }

    @Transactional(readOnly = true)
    public ApiRegistryResponse findById(Long id) {
        ApiRegistry entity = repository.findById(id)
                .orElseThrow(() -> new RuntimeException("API not found: " + id));
        return ApiRegistryResponse.from(entity);
    }

    @Transactional
    public ApiRegistryResponse create(ApiRegistryRequest request) {
        ApiRegistry entity = ApiRegistry.builder()
                .name(request.getName())
                .description(request.getDescription())
                .apiGroup(request.getApiGroup())
                .url(request.getUrl())
                .httpMethod(request.getHttpMethod())
                .build();
        return ApiRegistryResponse.from(repository.save(entity));
    }

    @Transactional
    public ApiRegistryResponse update(Long id, ApiRegistryRequest request) {
        ApiRegistry entity = repository.findById(id)
                .orElseThrow(() -> new RuntimeException("API not found: " + id));
        entity.setName(request.getName());
        entity.setDescription(request.getDescription());
        entity.setApiGroup(request.getApiGroup());
        entity.setUrl(request.getUrl());
        entity.setHttpMethod(request.getHttpMethod());
        return ApiRegistryResponse.from(repository.save(entity));
    }

    @Transactional
    public void delete(Long id) {
        if (!repository.existsById(id)) {
            throw new RuntimeException("API not found: " + id);
        }
        repository.deleteById(id);
    }

    @Transactional
    public void deleteByIds(List<Long> ids) {
        repository.deleteAllById(ids);
    }
}
