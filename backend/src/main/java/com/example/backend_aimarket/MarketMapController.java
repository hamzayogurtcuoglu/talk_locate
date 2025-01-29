package com.example.backend_aimarket.controller;

import com.example.backend_aimarket.model.MarketMap;
import com.example.backend_aimarket.repository.MarketMapRepository;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/maps")
public class MarketMapController {

    private final MarketMapRepository repository;

    public MarketMapController(MarketMapRepository repository) {
        this.repository = repository;
    }

    @PostMapping
    public ResponseEntity<String> saveMap(@RequestBody String mapData) {
        MarketMap marketMap = new MarketMap();
        marketMap.setMapData(mapData);
        MarketMap saved = repository.save(marketMap);
        return ResponseEntity.ok(saved.getId());
    }

    @GetMapping("/{id}")
    public ResponseEntity<String> loadMap(@PathVariable String id) {
        return repository.findById(id)
                .map(map -> ResponseEntity.ok(map.getMapData()))
                .orElse(ResponseEntity.notFound().build());
    }
}