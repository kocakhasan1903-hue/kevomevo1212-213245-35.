package server.data.classes.article;


public enum Category {

    NOTICIAS(1, "Noticias"),
    NOVEDADES(2, "Novedades"),
    EVENTOS(3, "Eventos"),
    CONCURSOS(4, "Concursos"),
    CAMPANAS(5, "Campañas");


    private int id;
    private String category;

    Category(int id, String category) {
        this.id = id;
        this.category = category;
    }

    public int getId() {
        return id;
    }

    public String getCategory() {
        return category;
    }
}

