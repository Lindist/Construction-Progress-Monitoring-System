package repository

import (
	"context"
	"encoding/json"
	"fmt"
	"log"

	"github.com/redis/go-redis/v9"
)

type QueueManager interface {
	EnqueueJob(ctx context.Context, queueName string, payload interface{}) error
}

type redisQueueManager struct {
	client *redis.Client
}

func NewRedisQueueManager(redisURL string) (QueueManager, error) {
	opts, err := redis.ParseURL(redisURL)
	if err != nil {
		return nil, fmt.Errorf("failed to parse redis URL: %w", err)
	}

	client := redis.NewClient(opts)
	// Ping connection
	_, err = client.Ping(context.Background()).Result()
	if err != nil {
		log.Printf("Warning: failed to connect to Redis at %s: %v. Queue operations will be unavailable.\n", redisURL, err)
	} else {
		log.Printf("Redis connection successful at %s\n", redisURL)
	}

	return &redisQueueManager{client: client}, nil
}

func (q *redisQueueManager) EnqueueJob(ctx context.Context, queueName string, payload interface{}) error {
	if q.client == nil {
		return fmt.Errorf("redis client is not initialized")
	}

	jsonData, err := json.Marshal(payload)
	if err != nil {
		return fmt.Errorf("failed to marshal job payload: %w", err)
	}

	err = q.client.RPush(ctx, queueName, string(jsonData)).Err()
	if err != nil {
		return fmt.Errorf("failed to push job to redis queue %s: %w", queueName, err)
	}

	return nil
}
