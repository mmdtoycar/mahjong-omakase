package com.mahjong.omakase.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;
import lombok.Data;

@Data
public class CreatePlayerRequest {
  @NotBlank(message = "Username is required")
  @Size(min = 2, max = 12, message = "Username must be 2-12 characters")
  @Pattern(
      regexp = "^[a-zA-Z0-9_\\u4e00-\\u9fa5]+$",
      message = "Username can only contain letters, numbers, underscores, and Chinese characters")
  private String userName;

  @NotBlank(message = "First name is required")
  @Size(max = 50, message = "First name must be at most 50 characters")
  private String firstName;

  @NotBlank(message = "Last name is required")
  @Size(max = 50, message = "Last name must be at most 50 characters")
  private String lastName;
}
