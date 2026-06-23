package com.mahjong.omakase.config;

import com.fasterxml.jackson.core.JsonGenerator;
import com.fasterxml.jackson.databind.SerializerProvider;
import com.fasterxml.jackson.databind.ser.std.StdSerializer;
import java.io.IOException;
import java.time.LocalDateTime;
import java.time.ZoneOffset;
import java.time.format.DateTimeFormatter;
import org.springframework.boot.autoconfigure.jackson.Jackson2ObjectMapperBuilderCustomizer;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

/**
 * 全站 LocalDateTime 序列化为带 'Z' 的 ISO-8601 字符串. 我们的存储约定是「LocalDateTime 视为 UTC instant」(JVM TZ 锁在 UTC),
 * 没有时区标记的 ISO 字符串在浏览器里会被当成本地时间, 在 PT 浏览器上会把 UTC 时间显示成 PT 数字, 即 main 页"显示成 UTC". 加上 'Z' 后 `new
 * Date(...)` 准确解析为 UTC instant, 前端再用 `toLocaleString({ timeZone: 'America/Los_Angeles' })` 转成 PT
 * 即可.
 *
 * <p>使用 {@link DateTimeFormatter#ISO_INSTANT} 保留源 {@code LocalDateTime} 自带的精度 (秒 / 毫秒 / 纳秒 都按需输出),
 * 不强行截到秒.
 */
@Configuration
public class JacksonConfig {

  @Bean
  Jackson2ObjectMapperBuilderCustomizer localDateTimeAsUtcCustomizer() {
    return builder ->
        builder.serializerByType(LocalDateTime.class, new UtcLocalDateTimeSerializer());
  }

  private static final class UtcLocalDateTimeSerializer extends StdSerializer<LocalDateTime> {
    UtcLocalDateTimeSerializer() {
      super(LocalDateTime.class);
    }

    @Override
    public void serialize(LocalDateTime value, JsonGenerator gen, SerializerProvider provider)
        throws IOException {
      gen.writeString(DateTimeFormatter.ISO_INSTANT.format(value.toInstant(ZoneOffset.UTC)));
    }
  }
}
