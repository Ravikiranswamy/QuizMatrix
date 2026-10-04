package com.Ravikiran.Quizzapp.dao;

import com.Ravikiran.Quizzapp.model.Quiz;
import org.springframework.data.jpa.repository.JpaRepository;

public interface QuizDao extends JpaRepository<Quiz,Integer>{
}
