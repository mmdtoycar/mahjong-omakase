package com.mahjong.omakase.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

public class CreatePlayerRequest {
  @NotBlank(message = "Username is required")
  @Size(min = 2, max = 30, message = "Username must be 2-30 characters")
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

  public String getUserName() {
    return userName;
  }

  public void setUserName(String userName) {
    this.userName = userName;
  }

  public String getFirstName() {
    return firstName;
  }

  public void setFirstName(String firstName) {
    this.firstName = firstName;
  }

  public String getLastName() {
    return lastName;
  }

  public void setLastName(String lastName) {
    this.lastName = lastName;
  }
}
