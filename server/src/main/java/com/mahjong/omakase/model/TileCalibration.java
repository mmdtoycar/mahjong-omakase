package com.mahjong.omakase.model;

import jakarta.persistence.*;
import java.time.LocalDateTime;
import lombok.AllArgsConstructor;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

@Entity
@Table(name = "tile_calibrations")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
public class TileCalibration {

  @Id
  @GeneratedValue(strategy = GenerationType.IDENTITY)
  private Long id;

  @Column(name = "hand_text", length = 500)
  private String handText;

  @Lob
  @Column(name = "image_preview", columnDefinition = "CLOB")
  private String imagePreview;

  @Column(name = "is_full_34_set")
  private Boolean isFull34Set = false;

  @Column(name = "created_at")
  private LocalDateTime createdAt = LocalDateTime.now();
}
