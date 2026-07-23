package com.atworks.backend.registry;

import org.springframework.data.jpa.repository.JpaRepository;
import java.util.List;

public interface ApiRegistryRepository extends JpaRepository<ApiRegistry, Long> {
    List<ApiRegistry> findAllByOrderByCreatedAtDesc();
    List<ApiRegistry> findByApiGroupIgnoreCase(String apiGroup);
}
