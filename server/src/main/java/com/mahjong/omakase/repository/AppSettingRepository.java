package com.mahjong.omakase.repository;

import com.mahjong.omakase.model.AppSetting;
import org.springframework.data.jpa.repository.JpaRepository;

public interface AppSettingRepository extends JpaRepository<AppSetting, String> {}
