### Extra (If project grows in complexity)

### Testing

- [ ] Create an end-to-end (E2E) test suite using Cypress
- [ ] Cover URL creation, redirection, analytics, expiration, and error scenarios
- [ ] Integrate Cypress execution into CI/CD pipeline

### Asynchronous Processing

- [ ] Introduce a message broker (RabbitMQ or BullMQ)
- [ ] Move non-critical operations to asynchronous jobs
  - Click tracking
  - Analytics aggregation
  - Audit logs
  - Notifications
- [ ] Implement retry and dead-letter queue strategies

### Scalability

- [ ] Containerize the application with Docker
- [ ] Run multiple application replicas
- [ ] Configure Docker Swarm cluster
- [ ] Explore Kubernetes deployment as an alternative orchestration solution

### Load Balancing

- [ ] Add Nginx as a reverse proxy and load balancer
- [ ] Configure traffic distribution across replicas
- [ ] Implement health checks
- [ ] Support zero-downtime deployments

### Real-Time Features

- [ ] Add WebSocket support for real-time updates
- [ ] Broadcast link analytics updates in real time
- [ ] Notify clients when URLs are created or updated

### Distributed WebSockets

- [ ] Integrate RabbitMQ or Redis Pub/Sub for cross-instance communication
- [ ] Synchronize WebSocket events between replicas
- [ ] Handle distributed event broadcasting

### Session Management

- [ ] Implement sticky sessions for WebSocket connections
- [ ] Evaluate session affinity strategies in Nginx
- [ ] Ensure stable connections across multiple replicas

### High Availability

- [ ] Deploy multiple application instances
- [ ] Add redundancy for message broker services
- [ ] Simulate node failures and recovery scenarios
- [ ] Validate system resilience under load

### Performance & Load Testing

- [ ] Create load tests with k6
- [ ] Benchmark single-instance vs multi-instance deployments
- [ ] Measure throughput and latency under concurrent traffic
- [ ] Stress-test WebSocket connections at scale
