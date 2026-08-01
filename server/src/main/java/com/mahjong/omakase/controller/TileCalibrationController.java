package com.mahjong.omakase.controller;

import com.mahjong.omakase.dto.TileCalibrationDTO;
import com.mahjong.omakase.model.TileCalibration;
import com.mahjong.omakase.repository.TileCalibrationRepository;
import java.time.LocalDateTime;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

@Slf4j
@RestController
@RequestMapping("/api/calibration")
public class TileCalibrationController {

  private final TileCalibrationRepository repository;

  public TileCalibrationController(TileCalibrationRepository repository) {
    this.repository = repository;
  }

  @GetMapping("/active")
  public ResponseEntity<TileCalibrationDTO> getActive() {
    return repository
        .findFirstByOrderByIdDesc()
        .map(TileCalibrationDTO::fromEntity)
        .map(ResponseEntity::ok)
        .orElseGet(() -> ResponseEntity.noContent().build());
  }

  @PostMapping
  public TileCalibrationDTO save(@RequestBody TileCalibrationDTO dto) {
    TileCalibration entity = new TileCalibration();
    entity.setImagePreview(dto.getImagePreview());
    entity.setHandText(dto.getHandText());
    entity.setIsFull34Set(Boolean.TRUE.equals(dto.getIsFull34Set()));
    entity.setCreatedAt(LocalDateTime.now());

    TileCalibration saved = repository.save(entity);
    log.info("Saved new server tile calibration with ID {}", saved.getId());
    return TileCalibrationDTO.fromEntity(saved);
  }

  @DeleteMapping
  public ResponseEntity<Void> deleteAll() {
    repository.deleteAll();
    log.info("Cleared all server tile calibrations");
    return ResponseEntity.noContent().build();
  }
}
