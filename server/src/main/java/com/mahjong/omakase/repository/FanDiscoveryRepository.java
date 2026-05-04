package com.mahjong.omakase.repository;

import com.mahjong.omakase.model.FanDiscovery;
import java.util.List;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

@Repository
public interface FanDiscoveryRepository extends JpaRepository<FanDiscovery, Long> {
  Optional<FanDiscovery> findBySeasonAndFanName(String season, String fanName);

  Optional<FanDiscovery> findBySeasonAndFanNameAndPlayerBotFalse(String season, String fanName);

  List<FanDiscovery> findBySeason(String season);
}
