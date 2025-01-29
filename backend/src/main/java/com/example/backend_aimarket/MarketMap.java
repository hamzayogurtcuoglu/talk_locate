package com.example.backend_aimarket.model;

import lombok.Data;
import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.mapping.Document;
import java.time.Instant;

@Data
@Document(collection = "market_maps")
public class MarketMap {
    @Id
    private String id;
    private String mapData;
    private Instant createdAt = Instant.now();
    private Instant updatedAt = Instant.now();
}