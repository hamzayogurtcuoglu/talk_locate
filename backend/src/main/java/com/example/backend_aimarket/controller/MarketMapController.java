package com.example.backend_aimarket.controller;

import com.example.backend_aimarket.model.MarketMap;
import com.example.backend_aimarket.repository.MarketMapRepository;
import org.json.JSONException;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.json.JSONObject;
import java.util.UUID;

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
        String mapDataId;
        try {
            JSONObject mapDataJson = new JSONObject(mapData);
            mapDataId = mapDataJson.getString("filename");
        } catch (JSONException e) {
//            throw new RuntimeException(e);
            mapDataId = UUID.randomUUID().toString().substring(0, 6); // filename boş gelirse
        }
        marketMap.setId(mapDataId);
        MarketMap saved = repository.save(marketMap);
        System.out.println(mapDataId + " SAVED!");
        return ResponseEntity.ok(saved.getId());
    }

    @GetMapping("/{id}")
    public ResponseEntity<String> loadMap(@PathVariable String id) {
        System.out.println("LOAD: " + id);
        return repository.findById(id)
                .map(map -> ResponseEntity.ok(map.getMapData()))
                .orElse(ResponseEntity.notFound().build());
    }
}