FROM eclipse-temurin:17-jdk AS build
WORKDIR /app
COPY gradlew settings.gradle build.gradle ./
COPY gradle ./gradle
COPY server/src ./server/src
COPY ui ./ui
RUN chmod +x gradlew && ./gradlew build -x test -x spotlessCheck -x spotlessApply

FROM eclipse-temurin:17-jre
WORKDIR /app
ENV TZ=Etc/UTC
RUN mkdir -p /app/data
COPY --from=build /app/build/libs/mahjong-omakase-*-SNAPSHOT.jar app.jar
EXPOSE 8080
ENTRYPOINT ["java", "-Duser.timezone=UTC", "-Xmx512m", "-Xms256m", "-jar", "app.jar"]
