package http

type EventBroker struct {
	Notifier       chan string
	newClients     chan chan string
	closingClients chan chan string
	clients        map[chan string]bool
}

func NewEventBroker() *EventBroker {
	broker := &EventBroker{
		Notifier:       make(chan string, 1),
		newClients:     make(chan chan string),
		closingClients: make(chan chan string),
		clients:        make(map[chan string]bool),
	}
	go broker.listen()
	return broker
}

func (b *EventBroker) listen() {
	for {
		select {
		case s := <-b.newClients:
			b.clients[s] = true
		case s := <-b.closingClients:
			delete(b.clients, s)
			close(s)
		case event := <-b.Notifier:
			for clientMessageChan := range b.clients {
				// Non-blocking write to client channel
				select {
				case clientMessageChan <- event:
				default:
				}
			}
		}
	}
}
