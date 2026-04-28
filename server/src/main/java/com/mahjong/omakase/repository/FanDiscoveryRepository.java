package com.mahjong.omakase.repository;

import com.mahjong.omakase.model.FanDiscovery;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

@Repository
public interface FanDiscoveryRepository extends JpaRepository<FanDiscovery, String> {
}
