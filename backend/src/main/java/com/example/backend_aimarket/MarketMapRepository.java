package com.example.backend_aimarket.repository;

import com.example.backend_aimarket.model.MarketMap;
import org.springframework.data.mongodb.repository.MongoRepository;

public interface MarketMapRepository extends MongoRepository<MarketMap, String> {
}