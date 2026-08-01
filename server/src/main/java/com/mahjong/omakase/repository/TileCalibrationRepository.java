package com.mahjong.omakase.repository;

import com.mahjong.omakase.model.TileCalibration;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

@Repository
public interface TileCalibrationRepository extends JpaRepository<TileCalibration, Long> {
  Optional<TileCalibration> findFirstByOrderByIdDesc();
}
